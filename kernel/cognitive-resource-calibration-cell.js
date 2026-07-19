'use strict';

const KeySafeJson = require('./key-safe-json-transport-cell');
const Metrology = require('./cognitive-work-metrology-cell');

const CELL_ID = 'axm.mirror.cognitive-resource-calibration-cell/v1';
const PREDICTION_DRAFT_SCHEMA = 'axm.mirror.cognitive-resource-prediction-draft/v1';
const PREDICTION_SCHEMA = 'axm.mirror.cognitive-resource-prediction/v1';
const REPORT_SCHEMA = 'axm.mirror.cognitive-resource-calibration-report/v1';
const MIN_EVALUATED_PREDICTIONS = 20;
const MIN_DISTINCT_STARTING_STATES = 5;
const SHA256 = /^[a-f0-9]{64}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/;
const MACHINE_TOKEN = /^[A-Z][A-Z0-9_]{0,79}$/;
const METRICS = [
  'totalTokens',
  'wallMilliseconds',
  'cpuCoreMilliseconds',
  'acceleratorMilliseconds',
  'peakMemoryBytes',
  'providerComputeUnitsMicros',
  'moneyMicros',
  'energyMilliwattHours',
  'carbonMilligrams'
];

function stable(value) { return KeySafeJson.stable(value); }
function digest(value) { return KeySafeJson.digest(value); }
function same(left, right) { return KeySafeJson.same(left, right); }
function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !same(Object.keys(value).sort(), keys.slice().sort())) throw new Error(`${label} fields changed`);
}
function sha(value, field, nullable = false) {
  if (value === null && nullable) return null;
  if (!SHA256.test(String(value || ''))) throw new Error(`${field} requires a SHA-256 digest`);
  return String(value);
}
function id(value, field, nullable = false) {
  if (value === null && nullable) return null;
  const text = String(value || '');
  if (!ID.test(text)) throw new Error(`${field} requires a bounded machine identifier`);
  return text;
}
function token(value, field) {
  const text = String(value || '');
  if (!MACHINE_TOKEN.test(text)) throw new Error(`${field} requires a bounded machine token`);
  return text;
}
function count(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${field} requires a non-negative safe integer`);
  return value;
}
function enumValue(value, allowed, field) {
  if (!allowed.includes(value)) throw new Error(`${field} changed`);
  return value;
}
function interval(value, field, nullable = true) {
  if (value === null && nullable) return null;
  exactKeys(value, ['lower', 'upper'], field);
  const normalized = { lower: count(value.lower, `${field}.lower`), upper: count(value.upper, `${field}.upper`) };
  if (normalized.lower > normalized.upper) throw new Error(`${field} lower exceeds upper`);
  return normalized;
}
function predictionDraftFromRecord(prediction) {
  return {
    schema: PREDICTION_DRAFT_SCHEMA,
    source: prediction.source,
    target: prediction.target,
    method: prediction.method,
    intervals: prediction.intervals,
    costBinding: prediction.costBinding,
    permission: prediction.permission
  };
}

function normalizeDraft(draft) {
  exactKeys(draft, ['schema', 'source', 'target', 'method', 'intervals', 'costBinding', 'permission'], 'cognitive-resource prediction draft');
  if (draft.schema !== PREDICTION_DRAFT_SCHEMA) throw new Error('cognitive-resource prediction draft schema changed');
  exactKeys(draft.source, ['sourceSystemId', 'sourceRecordId', 'sourceRecordDigest', 'collectionMethod', 'authorshipState', 'sequence', 'priorPredictionDigest'], 'prediction source');
  const source = {
    sourceSystemId: id(draft.source.sourceSystemId, 'source.sourceSystemId'),
    sourceRecordId: id(draft.source.sourceRecordId, 'source.sourceRecordId'),
    sourceRecordDigest: sha(draft.source.sourceRecordDigest, 'source.sourceRecordDigest', true),
    collectionMethod: enumValue(draft.source.collectionMethod, ['DIRECT_MACHINE_SEAL', 'IMPORTED_ATTESTATION', 'MANUAL_DECLARATION'], 'source.collectionMethod'),
    authorshipState: enumValue(draft.source.authorshipState, ['DECLARED_NOT_CERTIFIED', 'UNKNOWN'], 'source.authorshipState'),
    sequence: count(draft.source.sequence, 'source.sequence'),
    priorPredictionDigest: sha(draft.source.priorPredictionDigest, 'source.priorPredictionDigest', true)
  };

  exactKeys(draft.target, ['objectiveKind', 'objectiveDigest', 'startingStateDigest', 'comparisonKey'], 'prediction target');
  const target = {
    objectiveKind: token(draft.target.objectiveKind, 'target.objectiveKind'),
    objectiveDigest: sha(draft.target.objectiveDigest, 'target.objectiveDigest'),
    startingStateDigest: sha(draft.target.startingStateDigest, 'target.startingStateDigest'),
    comparisonKey: sha(draft.target.comparisonKey, 'target.comparisonKey')
  };

  exactKeys(draft.method, ['methodId', 'methodDigest', 'resourceProfileId', 'resourceProfileDigest', 'targetCoverageBasisPoints'], 'prediction method');
  const method = {
    methodId: id(draft.method.methodId, 'method.methodId'),
    methodDigest: sha(draft.method.methodDigest, 'method.methodDigest'),
    resourceProfileId: id(draft.method.resourceProfileId, 'method.resourceProfileId'),
    resourceProfileDigest: sha(draft.method.resourceProfileDigest, 'method.resourceProfileDigest'),
    targetCoverageBasisPoints: count(draft.method.targetCoverageBasisPoints, 'method.targetCoverageBasisPoints')
  };
  if (method.targetCoverageBasisPoints < 1 || method.targetCoverageBasisPoints > 9999) throw new Error('target coverage must be between 1 and 9999 basis points');

  exactKeys(draft.intervals, METRICS, 'prediction intervals');
  const intervals = Object.fromEntries(METRICS.map(metric => [metric, interval(draft.intervals[metric], `intervals.${metric}`)]));
  if (intervals.totalTokens === null || intervals.wallMilliseconds === null) throw new Error('prediction requires token and wall-time intervals');

  let costBinding = null;
  const hasCostInterval = ['moneyMicros', 'energyMilliwattHours', 'carbonMilligrams'].some(metric => intervals[metric] !== null);
  if (draft.costBinding !== null) {
    exactKeys(draft.costBinding, ['costProfileDigest', 'currency'], 'prediction cost binding');
    costBinding = {
      costProfileDigest: sha(draft.costBinding.costProfileDigest, 'costBinding.costProfileDigest'),
      currency: draft.costBinding.currency === null ? null : String(draft.costBinding.currency)
    };
    if (costBinding.currency !== null && !/^[A-Z]{3}$/.test(costBinding.currency)) throw new Error('costBinding.currency requires an ISO-style currency token');
  }
  if (hasCostInterval && costBinding === null) throw new Error('cost intervals require an exact cost binding');
  if (!hasCostInterval && costBinding !== null) throw new Error('cost binding without a predicted cost metric is not allowed');
  if (intervals.moneyMicros !== null && costBinding.currency === null) throw new Error('money interval requires a currency');

  exactKeys(draft.permission, ['status', 'basisDigest'], 'prediction permission');
  const permission = {
    status: enumValue(draft.permission.status, ['ALLOWED', 'UNKNOWN', 'FORBIDDEN'], 'permission.status'),
    basisDigest: sha(draft.permission.basisDigest, 'permission.basisDigest', true)
  };
  if (permission.status === 'ALLOWED' && permission.basisDigest === null) throw new Error('allowed prediction intake requires a permission basis');
  if (permission.status !== 'ALLOWED' && permission.basisDigest !== null) throw new Error('unknown or forbidden permission cannot carry a basis');
  return stable({ source, target, method, intervals, costBinding, permission });
}

function metricShape(intervals) {
  return METRICS.filter(metric => intervals[metric] !== null);
}

function calibrationBasis(normalized) {
  return {
    comparisonKey: normalized.target.comparisonKey,
    methodId: normalized.method.methodId,
    methodDigest: normalized.method.methodDigest,
    targetCoverageBasisPoints: normalized.method.targetCoverageBasisPoints,
    metricShape: metricShape(normalized.intervals),
    costBinding: normalized.costBinding
  };
}

function profileBoundary(profile, normalized, observations) {
  if (!profile || profile.schema !== Metrology.PROFILE_SCHEMA) throw new Error('prediction requires a verified cognitive-resource profile');
  if (profile.profileId !== normalized.method.resourceProfileId || profile.profileDigest !== normalized.method.resourceProfileDigest) throw new Error('prediction resource profile binding changed');
  if (profile.comparisonKey !== normalized.target.comparisonKey) throw new Error('prediction comparison key differs from resource profile');
  if (profile.state !== 'DESCRIPTIVE_RESOURCE_PROFILE_NOT_A_CALIBRATED_FORECAST') throw new Error('prediction requires a sufficiently supported descriptive profile');
  const observationsById = new Map(observations.map(observation => [observation.observationId, observation]));
  const profileObservations = profile.source.observationIds.map((observationId, index) => {
    const observation = observationsById.get(observationId);
    if (!observation || observation.observationDigest !== profile.source.observationDigests[index]) throw new Error('prediction resource profile source observation changed');
    return observation;
  });
  Metrology.verifyResourceProfile(profile, profileObservations);
  if (profileObservations.some(observation => observation.objective.objectiveKind !== normalized.target.objectiveKind)) throw new Error('prediction objective kind differs from resource profile cohort');
  const support = {
    totalTokens: profile.resources.allEligibleTotalTokens,
    wallMilliseconds: profile.resources.allEligibleWallMilliseconds,
    cpuCoreMilliseconds: profile.resources.allEligibleCpuCoreMilliseconds,
    acceleratorMilliseconds: profile.resources.allEligibleAcceleratorMilliseconds,
    peakMemoryBytes: profile.resources.allEligiblePeakMemoryBytes,
    providerComputeUnitsMicros: profile.resources.allEligibleProviderComputeUnitsMicros,
    moneyMicros: profile.resources.directlyObservedMoneyMicros && profile.resources.directlyObservedMoneyMicros.range,
    energyMilliwattHours: profile.resources.directlyObservedEnergyMilliwattHours,
    carbonMilligrams: profile.resources.directlyObservedCarbonMilligrams
  };
  for (const metric of METRICS) if (normalized.intervals[metric] !== null && support[metric] === null) throw new Error(`prediction metric lacks profile support: ${metric}`);
  if (normalized.costBinding !== null) {
    if (!profile.resources.directCostProfileDigests.includes(normalized.costBinding.costProfileDigest)) throw new Error('prediction cost profile is absent from resource profile');
    if (normalized.intervals.moneyMicros !== null && profile.resources.directlyObservedMoneyMicros.currency !== normalized.costBinding.currency) throw new Error('prediction currency differs from resource profile');
  }
}

function targetMatchesObservation(target, observation) {
  return observation.comparisonKey === target.comparisonKey &&
    observation.objective.objectiveKind === target.objectiveKind &&
    observation.objective.objectiveDigest === target.objectiveDigest &&
    observation.objective.startingStateDigest === target.startingStateDigest;
}

function sealPrediction(draft, profile, context = {}) {
  const normalized = normalizeDraft(draft);
  const observations = Array.isArray(context.observations) ? context.observations : [];
  for (const observation of observations) Metrology.verifyObservation(observation);
  profileBoundary(profile, normalized, observations);
  const predecessor = context.predecessor || null;
  if (predecessor === null) {
    if (normalized.source.sequence !== 0 || normalized.source.priorPredictionDigest !== null) throw new Error('first source prediction must begin at sequence zero without a predecessor');
  } else {
    if (predecessor.schema !== PREDICTION_SCHEMA || predecessor.source.sourceSystemId !== normalized.source.sourceSystemId) throw new Error('prediction predecessor source changed');
    if (normalized.source.sequence !== predecessor.source.sequence + 1 || normalized.source.priorPredictionDigest !== predecessor.predictionDigest) throw new Error('prediction source chain changed');
  }
  if (observations.some(observation => targetMatchesObservation(normalized.target, observation))) throw new Error('prediction target outcome already exists in the sealed observation inventory');
  const orderedObservations = observations.slice().sort((a, b) => a.observationId.localeCompare(b.observationId));
  const issues = [];
  if (normalized.permission.status !== 'ALLOWED') issues.push('PREDICTION_INTAKE_PERMISSION_NOT_ALLOWED');
  if (normalized.source.collectionMethod !== 'DIRECT_MACHINE_SEAL') issues.push('PREDICTION_NOT_DIRECT_MACHINE_SEAL');
  if (normalized.source.sourceRecordDigest === null) issues.push('PREDICTION_SOURCE_RECORD_DIGEST_MISSING');
  const prediction = {
    schema: PREDICTION_SCHEMA,
    predictionId: null,
    predictionDigest: null,
    organ: { id: CELL_ID, learnedWeights: false, automaticForecasting: false, automaticSelection: false },
    source: normalized.source,
    target: normalized.target,
    method: normalized.method,
    intervals: normalized.intervals,
    costBinding: normalized.costBinding,
    calibrationKey: digest(calibrationBasis(normalized)),
    localOrderEvidence: {
      observationIdsBeforeSeal: orderedObservations.map(item => item.observationId),
      observationDigestsBeforeSeal: orderedObservations.map(item => item.observationDigest),
      observationInventoryDigestBeforeSeal: digest(orderedObservations.map(item => ({ observationId: item.observationId, observationDigest: item.observationDigest }))),
      observationsPresentBeforeSeal: orderedObservations.length,
      exactTargetOutcomePresentBeforeSeal: false,
      externalTimeCertified: false
    },
    permission: normalized.permission,
    assessment: {
      heldOutEvaluationEligible: issues.length === 0,
      issues: issues.sort(),
      chronologyState: 'LOCAL_APPEND_ORDER_OBSERVED_EXTERNAL_TIME_NOT_CERTIFIED'
    },
    authority: {
      calibratedForecastClaim: false,
      costOptimization: false,
      modelSelection: false,
      hardwareSelection: false,
      budgetAllocation: false,
      permissionGrant: false,
      trainingAdmission: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    boundary: 'This bounded resource interval was sealed before Mirror had an exact matching outcome in its local append-only observation store. Local order is not independently time-certified authorship or external held-out independence. The prediction cannot claim calibration, choose a model, hardware, cost, budget, permission, training, runtime, canon, or world action.'
  };
  prediction.predictionId = `cognitive-resource-prediction-${digest(Object.assign({}, prediction, { predictionId: null, predictionDigest: null })).slice(0, 24)}`;
  prediction.predictionDigest = digest(Object.assign({}, prediction, { predictionDigest: null }));
  return stable(prediction);
}

function verifyPrediction(prediction, profile, observations, predecessor = null) {
  exactKeys(prediction, ['schema', 'predictionId', 'predictionDigest', 'organ', 'source', 'target', 'method', 'intervals', 'costBinding', 'calibrationKey', 'localOrderEvidence', 'permission', 'assessment', 'authority', 'boundary'], 'cognitive-resource prediction');
  if (!Array.isArray(observations)) throw new Error('prediction verification requires current observations');
  const byId = new Map(observations.map(item => [item.observationId, item]));
  const snapshot = prediction.localOrderEvidence.observationIdsBeforeSeal.map((observationId, index) => {
    const observation = byId.get(observationId);
    if (!observation || observation.observationDigest !== prediction.localOrderEvidence.observationDigestsBeforeSeal[index]) throw new Error('prediction pre-seal observation inventory changed');
    return observation;
  });
  const reconstructed = sealPrediction(predictionDraftFromRecord(prediction), profile, { observations: snapshot, predecessor });
  if (!same(reconstructed, prediction)) throw new Error('cognitive-resource prediction content changed');
  return true;
}

function verifyPredictionEnvelope(prediction) {
  exactKeys(prediction, ['schema', 'predictionId', 'predictionDigest', 'organ', 'source', 'target', 'method', 'intervals', 'costBinding', 'calibrationKey', 'localOrderEvidence', 'permission', 'assessment', 'authority', 'boundary'], 'cognitive-resource prediction');
  if (prediction.schema !== PREDICTION_SCHEMA || prediction.predictionDigest !== digest(Object.assign({}, prediction, { predictionDigest: null }))) throw new Error('cognitive-resource prediction digest changed');
  const expectedId = `cognitive-resource-prediction-${digest(Object.assign({}, prediction, { predictionId: null, predictionDigest: null })).slice(0, 24)}`;
  const normalized = normalizeDraft(predictionDraftFromRecord(prediction));
  if (prediction.predictionId !== expectedId || prediction.calibrationKey !== digest(calibrationBasis(normalized))) throw new Error('cognitive-resource prediction identity changed');
  if (prediction.localOrderEvidence.externalTimeCertified !== false || prediction.localOrderEvidence.exactTargetOutcomePresentBeforeSeal !== false || Object.values(prediction.authority || {}).some(Boolean)) throw new Error('cognitive-resource prediction boundary changed');
  return true;
}

function actualMetrics(observation) {
  return {
    totalTokens: observation.execution.tokenMeter.totalTokens,
    wallMilliseconds: observation.execution.timing.wallMilliseconds,
    cpuCoreMilliseconds: observation.execution.computeMeter.cpuCoreMilliseconds,
    acceleratorMilliseconds: observation.execution.computeMeter.acceleratorMilliseconds,
    peakMemoryBytes: observation.execution.computeMeter.peakMemoryBytes,
    providerComputeUnitsMicros: observation.execution.computeMeter.providerComputeUnitsMicros,
    moneyMicros: observation.costObservation.moneyMicros,
    energyMilliwattHours: observation.costObservation.energyMilliwattHours,
    carbonMilligrams: observation.costObservation.carbonMilligrams
  };
}

function evaluatePrediction(prediction, observations) {
  const matches = observations.filter(observation => targetMatchesObservation(prediction.target, observation));
  if (matches.length === 0) return { predictionId: prediction.predictionId, predictionDigest: prediction.predictionDigest, state: 'PENDING_NO_MATCHING_OUTCOME', observationId: null, observationDigest: null, metricResults: null, overallHit: null };
  if (matches.length > 1) return { predictionId: prediction.predictionId, predictionDigest: prediction.predictionDigest, state: 'HOLD_AMBIGUOUS_MULTIPLE_OUTCOMES', observationId: null, observationDigest: null, metricResults: null, overallHit: null };
  const observation = matches[0];
  if (!prediction.assessment.heldOutEvaluationEligible || !observation.assessment.resourceProfileEligible) {
    return { predictionId: prediction.predictionId, predictionDigest: prediction.predictionDigest, state: 'HOLD_INELIGIBLE_PREDICTION_OR_OUTCOME', observationId: observation.observationId, observationDigest: observation.observationDigest, metricResults: null, overallHit: null };
  }
  if (prediction.costBinding !== null) {
    if (observation.costObservation.profileDigest !== prediction.costBinding.costProfileDigest || observation.costObservation.currency !== prediction.costBinding.currency) {
      return { predictionId: prediction.predictionId, predictionDigest: prediction.predictionDigest, state: 'HOLD_COST_BINDING_MISMATCH', observationId: observation.observationId, observationDigest: observation.observationDigest, metricResults: null, overallHit: null };
    }
  }
  const actual = actualMetrics(observation);
  const metricResults = {};
  let evaluable = true;
  for (const metric of METRICS) {
    const predicted = prediction.intervals[metric];
    if (predicted === null) metricResults[metric] = { state: 'NOT_PREDICTED', actual: actual[metric], hit: null };
    else if (actual[metric] === null) {
      metricResults[metric] = { state: 'HOLD_OUTCOME_METRIC_ABSENT', actual: null, hit: null };
      evaluable = false;
    } else metricResults[metric] = { state: 'EVALUATED', actual: actual[metric], hit: actual[metric] >= predicted.lower && actual[metric] <= predicted.upper };
  }
  if (!evaluable) return { predictionId: prediction.predictionId, predictionDigest: prediction.predictionDigest, state: 'HOLD_PREDICTED_METRIC_ABSENT_FROM_OUTCOME', observationId: observation.observationId, observationDigest: observation.observationDigest, metricResults, overallHit: null };
  const evaluatedHits = METRICS.filter(metric => prediction.intervals[metric] !== null).map(metric => metricResults[metric].hit);
  return { predictionId: prediction.predictionId, predictionDigest: prediction.predictionDigest, state: 'EVALUATED', observationId: observation.observationId, observationDigest: observation.observationDigest, metricResults, overallHit: evaluatedHits.every(Boolean) };
}

function coverage(hits, evaluated) {
  return evaluated === 0 ? null : Math.floor((hits * 10000) / evaluated);
}

function buildCalibrationReport(predictions, observations, calibrationKey) {
  if (!Array.isArray(predictions) || !Array.isArray(observations)) throw new Error('calibration report requires prediction and observation arrays');
  sha(calibrationKey, 'calibrationKey');
  for (const observation of observations) Metrology.verifyObservation(observation);
  for (const prediction of predictions) verifyPredictionEnvelope(prediction);
  const selected = predictions.filter(item => item.calibrationKey === calibrationKey).slice().sort((a, b) => a.predictionId.localeCompare(b.predictionId));
  if (!selected.length) throw new Error('calibration key has no predictions');
  const targetCoverages = Array.from(new Set(selected.map(item => item.method.targetCoverageBasisPoints)));
  if (targetCoverages.length !== 1) throw new Error('calibration cohort target coverage changed');
  const evaluations = selected.map(prediction => evaluatePrediction(prediction, observations));
  const evaluated = evaluations.filter(item => item.state === 'EVALUATED');
  const metricCoverage = {};
  for (const metric of METRICS) {
    const rows = evaluated.filter(item => item.metricResults[metric].state === 'EVALUATED');
    const hits = rows.filter(item => item.metricResults[metric].hit).length;
    metricCoverage[metric] = { evaluated: rows.length, hits, misses: rows.length - hits, observedCoverageBasisPoints: coverage(hits, rows.length) };
  }
  const overallHits = evaluated.filter(item => item.overallHit).length;
  const distinctStarts = new Set(selected.filter(prediction => evaluated.some(row => row.predictionId === prediction.predictionId)).map(item => item.target.startingStateDigest)).size;
  const enough = evaluated.length >= MIN_EVALUATED_PREDICTIONS && distinctStarts >= MIN_DISTINCT_STARTING_STATES;
  const report = {
    schema: REPORT_SCHEMA,
    reportId: null,
    reportDigest: null,
    organ: { id: CELL_ID, learnedWeights: false, calibrationModel: false, automaticSelection: false },
    calibrationKey,
    source: {
      predictionIds: selected.map(item => item.predictionId),
      predictionDigests: selected.map(item => item.predictionDigest),
      observationIds: observations.slice().sort((a, b) => a.observationId.localeCompare(b.observationId)).map(item => item.observationId),
      observationDigests: observations.slice().sort((a, b) => a.observationId.localeCompare(b.observationId)).map(item => item.observationDigest),
      predictions: selected.length,
      evaluatedPredictions: evaluated.length,
      pendingPredictions: evaluations.filter(item => item.state === 'PENDING_NO_MATCHING_OUTCOME').length,
      heldPredictions: evaluations.filter(item => item.state.startsWith('HOLD_')).length,
      distinctEvaluatedStartingStates: distinctStarts
    },
    targetCoverageBasisPoints: targetCoverages[0],
    evaluations,
    coverage: {
      overall: { evaluated: evaluated.length, hits: overallHits, misses: evaluated.length - overallHits, observedCoverageBasisPoints: coverage(overallHits, evaluated.length) },
      metrics: metricCoverage
    },
    chronology: {
      localAppendOrderObserved: true,
      externalTimeCertified: false,
      independentAuthorshipCertified: false,
      pendingOutcomesExcludedFromDenominatorAndVisible: true
    },
    state: enough ? 'EMPIRICAL_LOCAL_ORDER_COVERAGE_NOT_INDEPENDENTLY_TIME_CERTIFIED' : 'HOLD_INSUFFICIENT_EVALUATED_PREDICTIONS',
    calibrationClaim: null,
    accuracyClaim: null,
    authority: {
      calibratedForecastClaim: false,
      costOptimization: false,
      modelSelection: false,
      hardwareSelection: false,
      budgetAllocation: false,
      permissionGrant: false,
      trainingAdmission: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    boundary: 'This report counts interval hits and misses for every locally sealed prediction in one exact calibration cohort that has one eligible matching outcome. Pending and held predictions remain visible. Local append order is not independently time-certified held-out authorship, and observed coverage is not a calibrated forecast, universal compute conversion, cost optimum, or selection authority.'
  };
  report.reportId = `cognitive-resource-calibration-${digest(Object.assign({}, report, { reportId: null, reportDigest: null })).slice(0, 24)}`;
  report.reportDigest = digest(Object.assign({}, report, { reportDigest: null }));
  return stable(report);
}

function verifyCalibrationReport(report, predictions, observations) {
  if (!report || report.schema !== REPORT_SCHEMA || report.reportDigest !== digest(Object.assign({}, report, { reportDigest: null }))) throw new Error('calibration report digest changed');
  const expectedId = `cognitive-resource-calibration-${digest(Object.assign({}, report, { reportId: null, reportDigest: null })).slice(0, 24)}`;
  if (report.reportId !== expectedId || report.calibrationClaim !== null || report.accuracyClaim !== null || Object.values(report.authority || {}).some(Boolean)) throw new Error('calibration report boundary changed');
  if (!same(buildCalibrationReport(predictions, observations, report.calibrationKey), report)) throw new Error('calibration report content changed');
  return true;
}

module.exports = {
  CELL_ID,
  PREDICTION_DRAFT_SCHEMA,
  PREDICTION_SCHEMA,
  REPORT_SCHEMA,
  MIN_EVALUATED_PREDICTIONS,
  MIN_DISTINCT_STARTING_STATES,
  METRICS,
  stable,
  digest,
  normalizeDraft,
  calibrationBasis,
  targetMatchesObservation,
  sealPrediction,
  verifyPredictionEnvelope,
  verifyPrediction,
  evaluatePrediction,
  buildCalibrationReport,
  verifyCalibrationReport
};
