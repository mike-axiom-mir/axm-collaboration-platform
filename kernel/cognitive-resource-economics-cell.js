'use strict';

const KeySafeJson = require('./key-safe-json-transport-cell');
const Metrology = require('./cognitive-work-metrology-cell');
const Calibration = require('./cognitive-resource-calibration-cell');

const CELL_ID = 'axm.mirror.cognitive-resource-economics-cell/v1';
const PROFILE_DRAFT_SCHEMA = 'axm.mirror.cognitive-resource-economics-profile-draft/v1';
const PROFILE_SCHEMA = 'axm.mirror.cognitive-resource-economics-profile/v1';
const ESTIMATE_SCHEMA = 'axm.mirror.cognitive-resource-cost-estimate/v1';
const SHA256 = /^[a-f0-9]{64}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/;
const METRICS = [
  'ACCELERATOR_MILLISECONDS',
  'CACHED_INPUT_TOKENS',
  'CPU_CORE_MILLISECONDS',
  'INPUT_TOKENS',
  'OUTPUT_TOKENS',
  'PROVIDER_COMPUTE_UNITS_MICROS',
  'REASONING_TOKENS',
  'TOTAL_TOKENS'
];
const TOKEN_COMPONENT_METRICS = new Set(['INPUT_TOKENS', 'CACHED_INPUT_TOKENS', 'OUTPUT_TOKENS', 'REASONING_TOKENS']);
const DIRECT_SOURCE_METHODS = new Set(['DIRECT_BILLING_SCHEDULE', 'DIRECT_HARDWARE_MEASUREMENT']);

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
function enumValue(value, allowed, field) {
  if (!allowed.includes(value)) throw new Error(`${field} changed`);
  return value;
}
function count(value, field, nullable = false, positive = false) {
  if (value === null && nullable) return null;
  if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0)) throw new Error(`${field} requires a ${positive ? 'positive' : 'non-negative'} safe integer`);
  return value;
}

function normalizeComponent(component, index) {
  const label = `economics component[${index}]`;
  exactKeys(component, ['metric', 'quantityDenominator', 'moneyMicrosPerQuantity', 'energyMilliwattHoursPerQuantity', 'carbonMilligramsPerQuantity'], label);
  const normalized = {
    metric: enumValue(component.metric, METRICS, `${label}.metric`),
    quantityDenominator: count(component.quantityDenominator, `${label}.quantityDenominator`, false, true),
    moneyMicrosPerQuantity: count(component.moneyMicrosPerQuantity, `${label}.moneyMicrosPerQuantity`, true),
    energyMilliwattHoursPerQuantity: count(component.energyMilliwattHoursPerQuantity, `${label}.energyMilliwattHoursPerQuantity`, true),
    carbonMilligramsPerQuantity: count(component.carbonMilligramsPerQuantity, `${label}.carbonMilligramsPerQuantity`, true)
  };
  if ([normalized.moneyMicrosPerQuantity, normalized.energyMilliwattHoursPerQuantity, normalized.carbonMilligramsPerQuantity].every(value => value === null)) {
    throw new Error(`${label} requires at least one declared rate`);
  }
  return normalized;
}

function normalizeProfileDraft(draft) {
  exactKeys(draft, ['schema', 'source', 'scope', 'components', 'permission'], 'cognitive-resource economics profile draft');
  if (draft.schema !== PROFILE_DRAFT_SCHEMA) throw new Error('cognitive-resource economics profile draft schema changed');

  exactKeys(draft.source, ['sourceSystemId', 'sourceRecordId', 'sourceRecordDigest', 'collectionMethod', 'authorshipState', 'rateScheduleDigest', 'effectiveWindowId', 'freshnessState'], 'economics profile source');
  const source = {
    sourceSystemId: id(draft.source.sourceSystemId, 'source.sourceSystemId'),
    sourceRecordId: id(draft.source.sourceRecordId, 'source.sourceRecordId'),
    sourceRecordDigest: sha(draft.source.sourceRecordDigest, 'source.sourceRecordDigest', true),
    collectionMethod: enumValue(draft.source.collectionMethod, ['DIRECT_BILLING_SCHEDULE', 'DIRECT_HARDWARE_MEASUREMENT', 'IMPORTED_ATTESTATION', 'MANUAL_DECLARATION'], 'source.collectionMethod'),
    authorshipState: enumValue(draft.source.authorshipState, ['DECLARED_NOT_CERTIFIED', 'UNKNOWN'], 'source.authorshipState'),
    rateScheduleDigest: sha(draft.source.rateScheduleDigest, 'source.rateScheduleDigest', true),
    effectiveWindowId: id(draft.source.effectiveWindowId, 'source.effectiveWindowId', true),
    freshnessState: enumValue(draft.source.freshnessState, ['CURRENT_DECLARED_NOT_CERTIFIED', 'HISTORICAL', 'UNKNOWN'], 'source.freshnessState')
  };

  exactKeys(draft.scope, ['accountingMode', 'currency', 'modelProfileDigest', 'hardwareProfileDigest', 'tokenMeterDefinitionId', 'computeMeterDefinitionId'], 'economics profile scope');
  const scope = {
    accountingMode: enumValue(draft.scope.accountingMode, ['PROVIDER_TOKEN_BILLING', 'PROVIDER_COMPUTE_UNIT_BILLING', 'LOCAL_HARDWARE_TIME'], 'scope.accountingMode'),
    currency: draft.scope.currency === null ? null : String(draft.scope.currency),
    modelProfileDigest: sha(draft.scope.modelProfileDigest, 'scope.modelProfileDigest', true),
    hardwareProfileDigest: sha(draft.scope.hardwareProfileDigest, 'scope.hardwareProfileDigest', true),
    tokenMeterDefinitionId: id(draft.scope.tokenMeterDefinitionId, 'scope.tokenMeterDefinitionId', true),
    computeMeterDefinitionId: id(draft.scope.computeMeterDefinitionId, 'scope.computeMeterDefinitionId', true)
  };
  if (scope.currency !== null && !/^[A-Z]{3}$/.test(scope.currency)) throw new Error('scope.currency requires an ISO-style currency token');

  if (!Array.isArray(draft.components) || draft.components.length < 1 || draft.components.length > 8) throw new Error('economics profile requires one to eight components');
  const components = draft.components.map(normalizeComponent).sort((left, right) => left.metric.localeCompare(right.metric));
  if (new Set(components.map(component => component.metric)).size !== components.length) throw new Error('economics profile component metrics must be unique');
  const metrics = new Set(components.map(component => component.metric));
  if (scope.accountingMode === 'PROVIDER_TOKEN_BILLING') {
    if ([...metrics].some(metric => metric !== 'TOTAL_TOKENS' && !TOKEN_COMPONENT_METRICS.has(metric))) throw new Error('provider token billing contains a non-token metric');
    if (metrics.has('TOTAL_TOKENS') && metrics.size > 1) throw new Error('total-token and component-token rates cannot be combined');
  }
  if (scope.accountingMode === 'PROVIDER_COMPUTE_UNIT_BILLING' && (metrics.size !== 1 || !metrics.has('PROVIDER_COMPUTE_UNITS_MICROS'))) {
    throw new Error('provider compute-unit billing requires only PROVIDER_COMPUTE_UNITS_MICROS');
  }
  if (scope.accountingMode === 'LOCAL_HARDWARE_TIME' && [...metrics].some(metric => !['CPU_CORE_MILLISECONDS', 'ACCELERATOR_MILLISECONDS'].includes(metric))) {
    throw new Error('local hardware time contains a non-hardware-time metric');
  }
  const hasMoneyRate = components.some(component => component.moneyMicrosPerQuantity !== null);
  if (hasMoneyRate && scope.currency === null) throw new Error('money rates require one bound currency');

  exactKeys(draft.permission, ['status', 'basisDigest'], 'economics profile permission');
  const permission = {
    status: enumValue(draft.permission.status, ['ALLOWED', 'UNKNOWN', 'FORBIDDEN'], 'permission.status'),
    basisDigest: sha(draft.permission.basisDigest, 'permission.basisDigest', true)
  };
  if (permission.status === 'ALLOWED' && permission.basisDigest === null) throw new Error('allowed economics profile intake requires a permission basis digest');
  if (permission.status !== 'ALLOWED' && permission.basisDigest !== null) throw new Error('unknown or forbidden economics profile permission cannot carry an inferred basis');
  return stable({ source, scope, components, permission });
}

function profileAssessment(normalized) {
  const issues = [];
  if (normalized.permission.status !== 'ALLOWED') issues.push('INTAKE_PERMISSION_NOT_ALLOWED');
  if (normalized.source.sourceRecordDigest === null) issues.push('SOURCE_RECORD_DIGEST_MISSING');
  if (normalized.source.rateScheduleDigest === null) issues.push('RATE_SCHEDULE_DIGEST_MISSING');
  if (normalized.scope.accountingMode === 'PROVIDER_TOKEN_BILLING') {
    if (normalized.scope.modelProfileDigest === null) issues.push('MODEL_PROFILE_DIGEST_MISSING');
    if (normalized.scope.tokenMeterDefinitionId === null) issues.push('TOKEN_METER_DEFINITION_ID_MISSING');
    if (normalized.scope.computeMeterDefinitionId !== null) issues.push('UNUSED_COMPUTE_METER_BINDING_PRESENT');
  }
  if (normalized.scope.accountingMode === 'PROVIDER_COMPUTE_UNIT_BILLING') {
    if (normalized.scope.modelProfileDigest === null) issues.push('MODEL_PROFILE_DIGEST_MISSING');
    if (normalized.scope.computeMeterDefinitionId === null) issues.push('COMPUTE_METER_DEFINITION_ID_MISSING');
    if (normalized.scope.tokenMeterDefinitionId !== null) issues.push('UNUSED_TOKEN_METER_BINDING_PRESENT');
  }
  if (normalized.scope.accountingMode === 'LOCAL_HARDWARE_TIME') {
    if (normalized.scope.hardwareProfileDigest === null) issues.push('HARDWARE_PROFILE_DIGEST_MISSING');
    if (normalized.scope.computeMeterDefinitionId === null) issues.push('COMPUTE_METER_DEFINITION_ID_MISSING');
    if (normalized.scope.tokenMeterDefinitionId !== null) issues.push('UNUSED_TOKEN_METER_BINDING_PRESENT');
  }
  return {
    estimateEligible: issues.length === 0,
    issues: issues.sort(),
    rateEvidenceClass: DIRECT_SOURCE_METHODS.has(normalized.source.collectionMethod) ? 'DIRECT_SOURCE_DECLARATION_NOT_CERTIFIED' : 'DECLARED_SOURCE_NOT_CERTIFIED',
    externalFreshnessCertified: false,
    nonlinearBillingSupported: false,
    universalTokenComputeConversion: false
  };
}

function sealProfile(draft) {
  const normalized = normalizeProfileDraft(draft);
  const assessment = profileAssessment(normalized);
  const profile = {
    schema: PROFILE_SCHEMA,
    profileId: null,
    profileDigest: null,
    organ: { id: CELL_ID, learnedWeights: false, automaticPriceRefresh: false, automaticSelection: false },
    source: normalized.source,
    scope: normalized.scope,
    components: normalized.components,
    permission: normalized.permission,
    assessment,
    state: assessment.estimateEligible ? 'READY_LINEAR_PROFILE_DERIVATION_NOT_CALIBRATED_COST' : 'HOLD_INCOMPLETE_ECONOMICS_PROFILE',
    authority: {
      billedCostClaim: false,
      measuredCostClaim: false,
      calibratedCostClaim: false,
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
    boundary: 'This profile preserves one content-bound linear resource-rate declaration. It does not certify price freshness, nonlinear billing, hardware power, carbon intensity, token-to-compute conversion, measured or billed cost, calibration, optimization, selection, budget, permission, training, promotion, canon, or action.'
  };
  profile.profileId = `cognitive-resource-economics-profile-${digest(Object.assign({}, profile, { profileId: null, profileDigest: null })).slice(0, 24)}`;
  profile.profileDigest = digest(Object.assign({}, profile, { profileDigest: null }));
  return stable(profile);
}

function profileDraftFromRecord(profile) {
  return { schema: PROFILE_DRAFT_SCHEMA, source: profile.source, scope: profile.scope, components: profile.components, permission: profile.permission };
}

function verifyProfile(profile) {
  exactKeys(profile, ['schema', 'profileId', 'profileDigest', 'organ', 'source', 'scope', 'components', 'permission', 'assessment', 'state', 'authority', 'boundary'], 'cognitive-resource economics profile');
  if (profile.schema !== PROFILE_SCHEMA || profile.profileDigest !== digest(Object.assign({}, profile, { profileDigest: null }))) throw new Error('cognitive-resource economics profile digest changed');
  const reconstructed = sealProfile(profileDraftFromRecord(profile));
  if (!same(reconstructed, profile)) throw new Error('cognitive-resource economics profile content changed');
  if (Object.values(profile.authority || {}).some(Boolean)) throw new Error('cognitive-resource economics profile authority changed');
  return true;
}

function point(value) { return value === null ? null : { lower: value, upper: value }; }
function observationSource(observation) {
  Metrology.verifyObservation(observation);
  return {
    kind: 'SEALED_COGNITIVE_WORK_OBSERVATION',
    sourceId: observation.observationId,
    sourceDigest: observation.observationDigest,
    comparisonKey: observation.comparisonKey,
    resourceProfileId: null,
    resourceProfileDigest: null,
    modelProfileDigest: observation.execution.modelProfileDigest,
    hardwareProfileDigest: observation.execution.hardwareProfileDigest,
    tokenMeterDefinitionId: observation.execution.tokenMeter.definitionId,
    computeMeterDefinitionId: observation.execution.computeMeter.definitionId,
    tokenCoverage: observation.execution.tokenMeter.coverage,
    computeCoverage: observation.execution.computeMeter.coverage,
    permissionStatus: observation.permission.status,
    resourceTargetCoverageBasisPoints: null,
    quantities: {
      INPUT_TOKENS: point(observation.execution.tokenMeter.inputTokens),
      CACHED_INPUT_TOKENS: point(observation.execution.tokenMeter.cachedInputTokens),
      OUTPUT_TOKENS: point(observation.execution.tokenMeter.outputTokens),
      REASONING_TOKENS: point(observation.execution.tokenMeter.reasoningTokens),
      TOTAL_TOKENS: point(observation.execution.tokenMeter.totalTokens),
      CPU_CORE_MILLISECONDS: point(observation.execution.computeMeter.cpuCoreMilliseconds),
      ACCELERATOR_MILLISECONDS: point(observation.execution.computeMeter.acceleratorMilliseconds),
      PROVIDER_COMPUTE_UNITS_MICROS: point(observation.execution.computeMeter.providerComputeUnitsMicros)
    }
  };
}

function predictionSource(prediction, resourceProfile, observations) {
  Calibration.verifyPredictionEnvelope(prediction);
  if (!resourceProfile || resourceProfile.profileId !== prediction.method.resourceProfileId || resourceProfile.profileDigest !== prediction.method.resourceProfileDigest) {
    throw new Error('economics prediction resource profile binding changed');
  }
  if (!Array.isArray(observations)) throw new Error('economics prediction estimate requires resource-profile source observations');
  const byId = new Map(observations.map(observation => [observation.observationId, observation]));
  const profileObservations = resourceProfile.source.observationIds.map((observationId, index) => {
    const observation = byId.get(observationId);
    if (!observation || observation.observationDigest !== resourceProfile.source.observationDigests[index]) throw new Error('economics prediction resource-profile observation changed');
    return observation;
  });
  Metrology.verifyResourceProfile(resourceProfile, profileObservations);
  if (!profileObservations.length) throw new Error('economics prediction resource profile has no source boundary');
  const boundary = profileObservations[0];
  return {
    kind: 'SEALED_COGNITIVE_RESOURCE_PREDICTION',
    sourceId: prediction.predictionId,
    sourceDigest: prediction.predictionDigest,
    comparisonKey: prediction.target.comparisonKey,
    resourceProfileId: resourceProfile.profileId,
    resourceProfileDigest: resourceProfile.profileDigest,
    modelProfileDigest: boundary.execution.modelProfileDigest,
    hardwareProfileDigest: boundary.execution.hardwareProfileDigest,
    tokenMeterDefinitionId: boundary.execution.tokenMeter.definitionId,
    computeMeterDefinitionId: boundary.execution.computeMeter.definitionId,
    tokenCoverage: 'COMPLETE',
    computeCoverage: 'COMPLETE',
    permissionStatus: prediction.permission.status,
    resourceTargetCoverageBasisPoints: prediction.method.targetCoverageBasisPoints,
    quantities: {
      INPUT_TOKENS: null,
      CACHED_INPUT_TOKENS: null,
      OUTPUT_TOKENS: null,
      REASONING_TOKENS: null,
      TOTAL_TOKENS: prediction.intervals.totalTokens,
      CPU_CORE_MILLISECONDS: prediction.intervals.cpuCoreMilliseconds,
      ACCELERATOR_MILLISECONDS: prediction.intervals.acceleratorMilliseconds,
      PROVIDER_COMPUTE_UNITS_MICROS: prediction.intervals.providerComputeUnitsMicros
    }
  };
}

function safeNumber(value, field) {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`${field} exceeds safe integer range`);
  return Number(value);
}
function multiplyInterval(quantity, numerator, denominator, field) {
  if (quantity === null || numerator === null) return null;
  const divisor = BigInt(denominator);
  const lowerProduct = BigInt(quantity.lower) * BigInt(numerator);
  const upperProduct = BigInt(quantity.upper) * BigInt(numerator);
  return {
    lower: safeNumber(lowerProduct / divisor, `${field}.lower`),
    upper: safeNumber((upperProduct + divisor - 1n) / divisor, `${field}.upper`)
  };
}
function sumIntervals(intervals, field) {
  const present = intervals.filter(Boolean);
  if (!present.length) return null;
  const lower = present.reduce((sum, interval) => sum + BigInt(interval.lower), 0n);
  const upper = present.reduce((sum, interval) => sum + BigInt(interval.upper), 0n);
  return { lower: safeNumber(lower, `${field}.lower`), upper: safeNumber(upper, `${field}.upper`) };
}

function estimateIssues(source, profile) {
  const issues = [];
  if (!profile.assessment.estimateEligible) issues.push('ECONOMICS_PROFILE_NOT_ELIGIBLE');
  if (source.permissionStatus !== 'ALLOWED') issues.push('RESOURCE_SOURCE_PERMISSION_NOT_ALLOWED');
  if (profile.scope.modelProfileDigest !== null && profile.scope.modelProfileDigest !== source.modelProfileDigest) issues.push('MODEL_PROFILE_BINDING_MISMATCH');
  if (profile.scope.hardwareProfileDigest !== null && profile.scope.hardwareProfileDigest !== source.hardwareProfileDigest) issues.push('HARDWARE_PROFILE_BINDING_MISMATCH');
  if (profile.scope.accountingMode === 'PROVIDER_TOKEN_BILLING') {
    if (profile.scope.tokenMeterDefinitionId !== source.tokenMeterDefinitionId) issues.push('TOKEN_METER_DEFINITION_MISMATCH');
    if (source.tokenCoverage !== 'COMPLETE') issues.push('TOKEN_METER_NOT_COMPLETE');
  } else {
    if (profile.scope.computeMeterDefinitionId !== source.computeMeterDefinitionId) issues.push('COMPUTE_METER_DEFINITION_MISMATCH');
    if (source.computeCoverage !== 'COMPLETE') issues.push('COMPUTE_METER_NOT_COMPLETE');
  }
  for (const component of profile.components) if (source.quantities[component.metric] === null) issues.push(`RESOURCE_METRIC_UNAVAILABLE_${component.metric}`);
  return Array.from(new Set(issues)).sort();
}

function buildEstimateFromSource(source, profile) {
  verifyProfile(profile);
  const issues = estimateIssues(source, profile);
  const compatible = issues.length === 0;
  const components = profile.components.map(component => {
    const quantity = source.quantities[component.metric];
    return {
      metric: component.metric,
      quantity,
      quantityDenominator: component.quantityDenominator,
      moneyMicrosPerQuantity: component.moneyMicrosPerQuantity,
      energyMilliwattHoursPerQuantity: component.energyMilliwattHoursPerQuantity,
      carbonMilligramsPerQuantity: component.carbonMilligramsPerQuantity,
      derived: compatible ? {
        moneyMicros: multiplyInterval(quantity, component.moneyMicrosPerQuantity, component.quantityDenominator, `${component.metric}.moneyMicros`),
        energyMilliwattHours: multiplyInterval(quantity, component.energyMilliwattHoursPerQuantity, component.quantityDenominator, `${component.metric}.energyMilliwattHours`),
        carbonMilligrams: multiplyInterval(quantity, component.carbonMilligramsPerQuantity, component.quantityDenominator, `${component.metric}.carbonMilligrams`)
      } : { moneyMicros: null, energyMilliwattHours: null, carbonMilligrams: null }
    };
  });
  const directRateSource = profile.assessment.rateEvidenceClass === 'DIRECT_SOURCE_DECLARATION_NOT_CERTIFIED';
  const estimate = {
    schema: ESTIMATE_SCHEMA,
    estimateId: null,
    estimateDigest: null,
    organ: { id: CELL_ID, learnedWeights: false, automaticOptimization: false, automaticSelection: false },
    source: {
      kind: source.kind,
      sourceId: source.sourceId,
      sourceDigest: source.sourceDigest,
      comparisonKey: source.comparisonKey,
      resourceProfileId: source.resourceProfileId,
      resourceProfileDigest: source.resourceProfileDigest,
      resourceTargetCoverageBasisPoints: source.resourceTargetCoverageBasisPoints
    },
    economicsProfile: {
      profileId: profile.profileId,
      profileDigest: profile.profileDigest,
      accountingMode: profile.scope.accountingMode,
      rateEvidenceClass: profile.assessment.rateEvidenceClass,
      freshnessState: profile.source.freshnessState,
      externalFreshnessCertified: false,
      nonlinearBillingSupported: false
    },
    components,
    totals: {
      basis: 'PROFILE_ESTIMATED',
      currency: profile.scope.currency,
      moneyMicros: compatible ? sumIntervals(components.map(component => component.derived.moneyMicros), 'totals.moneyMicros') : null,
      energyMilliwattHours: compatible ? sumIntervals(components.map(component => component.derived.energyMilliwattHours), 'totals.energyMilliwattHours') : null,
      carbonMilligrams: compatible ? sumIntervals(components.map(component => component.derived.carbonMilligrams), 'totals.carbonMilligrams') : null
    },
    assessment: {
      state: compatible
        ? (directRateSource ? 'PROFILE_DERIVED_INTERVAL_DIRECT_RATE_SOURCE_FRESHNESS_UNCERTIFIED' : 'PROFILE_DERIVED_INTERVAL_DECLARED_RATE_SOURCE_UNCERTIFIED')
        : 'HOLD_RESOURCE_ECONOMICS_BINDING',
      issues,
      exactLinearTransformation: compatible,
      billedCostClaim: false,
      measuredCostClaim: false,
      universalTokenComputeConversion: false,
      costCoverageClaim: null,
      accuracyClaim: null
    },
    authority: {
      directCostAdmission: false,
      calibratedCostClaim: false,
      costOptimization: false,
      candidateRanking: false,
      modelSelection: false,
      hardwareSelection: false,
      budgetAllocation: false,
      permissionGrant: false,
      trainingAdmission: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    boundary: 'This is a profile-derived linear interval over an exact resource observation or resource-prediction envelope. It is not measured or billed cost, price freshness, nonlinear billing, token-to-compute conversion, an 80% cost claim, calibrated accuracy, cheapest-path ranking, model or hardware selection, budget, permission, training, promotion, canon, or action.'
  };
  estimate.estimateId = `cognitive-resource-cost-estimate-${digest(Object.assign({}, estimate, { estimateId: null, estimateDigest: null })).slice(0, 24)}`;
  estimate.estimateDigest = digest(Object.assign({}, estimate, { estimateDigest: null }));
  return stable(estimate);
}

function estimateObservation(observation, profile) {
  return buildEstimateFromSource(observationSource(observation), profile);
}
function estimatePrediction(prediction, resourceProfile, profile, observations) {
  return buildEstimateFromSource(predictionSource(prediction, resourceProfile, observations), profile);
}
function verifyEstimate(estimate, sourceRecord, profile, context = {}) {
  exactKeys(estimate, ['schema', 'estimateId', 'estimateDigest', 'organ', 'source', 'economicsProfile', 'components', 'totals', 'assessment', 'authority', 'boundary'], 'cognitive-resource cost estimate');
  if (estimate.schema !== ESTIMATE_SCHEMA || estimate.estimateDigest !== digest(Object.assign({}, estimate, { estimateDigest: null }))) throw new Error('cognitive-resource cost estimate digest changed');
  const reconstructed = estimate.source.kind === 'SEALED_COGNITIVE_WORK_OBSERVATION'
    ? estimateObservation(sourceRecord, profile)
    : estimatePrediction(sourceRecord, context.resourceProfile, profile, context.observations);
  if (!same(reconstructed, estimate)) throw new Error('cognitive-resource cost estimate content changed');
  if (Object.values(estimate.authority || {}).some(Boolean)) throw new Error('cognitive-resource cost estimate authority changed');
  return true;
}

module.exports = {
  CELL_ID,
  PROFILE_DRAFT_SCHEMA,
  PROFILE_SCHEMA,
  ESTIMATE_SCHEMA,
  METRICS,
  stable,
  digest,
  normalizeProfileDraft,
  profileAssessment,
  sealProfile,
  verifyProfile,
  estimateObservation,
  estimatePrediction,
  verifyEstimate
};
